import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { z } from "zod";
import {
  journalFrontmatterSchema,
  photoSchema,
  placeSchema,
  type Photo,
  type Place,
} from "../src/lib/content-schema";
import {
  formatValidationIssue,
  issuesFromZod,
  validateContentGraph,
  type ContentRecord,
  type JournalContentRecord,
  type ValidationIssue,
} from "../src/lib/content-validation";

const contentDir = join(process.cwd(), "content");
const issues: ValidationIssue[] = [];

function sourcePath(path: string) {
  return relative(process.cwd(), path);
}

function contentFiles(directory: string, extension: string) {
  return readdirSync(join(contentDir, directory))
    .filter((file) => file.endsWith(extension))
    .sort()
    .map((file) => join(contentDir, directory, file));
}

function staticSyntaxError(sourceFile: ts.SourceFile, node: ts.Node, message: string) {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return new Error(`${position.line + 1}:${position.character + 1}: ${message}`);
}

function staticValue(node: ts.Expression, sourceFile: ts.SourceFile): unknown {
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
    return staticValue(node.expression, sourceFile);
  }
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) {
    return -Number(node.operand.text);
  }
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.map((element) => {
      if (ts.isSpreadElement(element) || ts.isOmittedExpression(element)) {
        throw staticSyntaxError(sourceFile, element, "Spread and omitted elements are not allowed in static content");
      }
      return staticValue(element, sourceFile);
    });
  }
  if (ts.isObjectLiteralExpression(node)) {
    return Object.fromEntries(node.properties.map((property) => {
      if (!ts.isPropertyAssignment(property)) {
        throw staticSyntaxError(sourceFile, property, "Frontmatter must contain static property assignments");
      }
      const name = property.name;
      if (!ts.isIdentifier(name) && !ts.isStringLiteralLike(name) && !ts.isNumericLiteral(name)) {
        throw staticSyntaxError(sourceFile, name, "Computed frontmatter keys are not allowed");
      }
      return [name.text, staticValue(property.initializer, sourceFile)];
    }));
  }

  throw staticSyntaxError(sourceFile, node, "Frontmatter values must be static JSON-compatible literals");
}

function parseFrontmatter(source: string, file: string): unknown {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const exported = ts.getModifiers(statement)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
    if (!exported) continue;
    const declaration = statement.declarationList.declarations.find(
      (candidate) => ts.isIdentifier(candidate.name) && candidate.name.text === "frontmatter",
    );
    if (!declaration?.initializer) continue;
    return staticValue(declaration.initializer, sourceFile);
  }
  throw new Error("Missing exported frontmatter object");
}

function parseStaticExpression(source: string) {
  const sourceFile = ts.createSourceFile("article-expression.tsx", `(${source})`, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const statement = sourceFile.statements[0];
  if (!statement || !ts.isExpressionStatement(statement)) throw new Error("Invalid static expression");
  return staticValue(statement.expression, sourceFile);
}

function extractPhotoIds(source: string, file: string) {
  const ids: string[] = [];
  for (const match of source.matchAll(/<\s+(PhotoEmbed|PhotoGallery)\b/g)) {
    issues.push({ source: file, path: "article", message: `${match[1]} must start without whitespace after <` });
  }
  const tags = source.matchAll(/<(PhotoEmbed|PhotoGallery)\b[^>]*?(\/?>)/g);

  for (const match of tags) {
    const name = match[1];
    const tag = match[0];
    if (match[2] !== "/>" ) {
      issues.push({ source: file, path: "article", message: `${name} must use a self-closing tag` });
      continue;
    }

    if (name === "PhotoEmbed") {
      const id = tag.match(/\bid="([^"]+)"/);
      if (id) ids.push(id[1]);
      else issues.push({ source: file, path: "article.PhotoEmbed", message: "PhotoEmbed requires a static string id" });
      continue;
    }

    const gallery = tag.match(/\bids\s*=\s*\{(\[[\s\S]*?\])\}/);
    if (!gallery) {
      issues.push({ source: file, path: "article.PhotoGallery", message: "PhotoGallery requires a static ids array" });
      continue;
    }

    try {
      const result = z.array(z.string().min(1)).safeParse(parseStaticExpression(gallery[1]));
      if (result.success) ids.push(...result.data);
      else issues.push(...issuesFromZod(result.error, file).map((issue) => ({ ...issue, path: `article.PhotoGallery${issue.path ? `.${issue.path}` : ""}` })));
    } catch (error) {
      issues.push({ source: file, path: "article.PhotoGallery", message: error instanceof Error ? error.message : String(error) });
    }
  }

  return ids;
}

function loadJsonRecords<T>(directory: string, schema: z.ZodType<T>): ContentRecord<T>[] {
  const records: ContentRecord<T>[] = [];
  for (const path of contentFiles(directory, ".json")) {
    const source = sourcePath(path);
    let value: unknown;
    try {
      value = JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
      issues.push({ source, message: `Invalid JSON: ${error instanceof Error ? error.message : String(error)}` });
      continue;
    }

    const result = schema.safeParse(value);
    if (result.success) records.push({ source, value: result.data });
    else issues.push(...issuesFromZod(result.error, source));
  }
  return records;
}

function loadJournals(): JournalContentRecord[] {
  const records: JournalContentRecord[] = [];
  for (const path of contentFiles("journals", ".mdx")) {
    const file = sourcePath(path);
    const source = readFileSync(path, "utf8");
    let frontmatter: unknown;
    try {
      frontmatter = parseFrontmatter(source, file);
    } catch (error) {
      issues.push({ source: file, path: "frontmatter", message: error instanceof Error ? error.message : String(error) });
      continue;
    }

    const result = journalFrontmatterSchema.safeParse(frontmatter);
    if (result.success) records.push({ source: file, value: result.data, photoIds: extractPhotoIds(source, file) });
    else issues.push(...issuesFromZod(result.error, file));
  }
  return records;
}

const places = loadJsonRecords<Place>("places", placeSchema);
const photos = loadJsonRecords<Photo>("photos", photoSchema);
const journals = loadJournals();
issues.push(...validateContentGraph({ places, photos, journals }));

if (issues.length) {
  console.error(`Content validation failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${formatValidationIssue(issue)}`);
  process.exitCode = 1;
} else {
  console.log(`Validated ${places.length} place(s), ${journals.length} journal(s), and ${photos.length} photo record(s).`);
}
