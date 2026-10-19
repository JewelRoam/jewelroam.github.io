import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { PageHeader } from "../components/Page";
import { embeddedProjects, type EmbeddedProjectId } from "../lib/embedded-projects";
import "./EmbeddedProjectPage.css";

export function EmbeddedProjectPage({ projectId }: { projectId: EmbeddedProjectId }) {
  const [loaded, setLoaded] = useState(false);
  const [frameSrc, setFrameSrc] = useState<string>();
  const project = embeddedProjects[projectId];
  const titleId = `${projectId}-title`;

  useEffect(() => {
    setFrameSrc(project.src);
  }, [project.src]);

  return (
    <section
      className={`page-shell embedded-project embedded-project--${projectId}`}
      aria-labelledby={titleId}
    >
      <PageHeader
        title={
          <a
            className="embedded-project__title-link"
            href={project.src}
            target="_blank"
            rel="noreferrer"
            aria-label={`在新标签页打开 ${project.title}`}
            title="在新标签页打开"
          >
            <span>{project.title}</span>
            <ArrowUpRight
              className="embedded-project__title-icon"
              strokeWidth={1.7}
              aria-hidden="true"
            />
          </a>
        }
        titleId={titleId}
        intro={project.description}
      />

      <div className="embedded-project__content">
        <div
          className="embedded-project__viewport"
          data-loaded={loaded}
          aria-busy={!loaded}
        >
          {!loaded && (
            <div className="embedded-project__loading" role="status">
              <span className="embedded-project__spinner" aria-hidden="true" />
              <span>正在载入 {project.label}</span>
            </div>
          )}
          {frameSrc && (
            <iframe
              className="embedded-project__frame"
              src={frameSrc}
              title={project.title}
              loading="eager"
              referrerPolicy="strict-origin-when-cross-origin"
              onLoad={() => setLoaded(true)}
            />
          )}
        </div>
      </div>
    </section>
  );
}
