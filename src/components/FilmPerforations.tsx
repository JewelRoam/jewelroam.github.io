const holes = Array.from({ length: 144 }, (_, index) => index);

export function FilmPerforations() {
  return (
    <span className="film-perforations" aria-hidden="true">
      {(["top", "bottom"] as const).map((edge) => (
        <span key={edge} className={`film-perforations__edge film-perforations__edge--${edge}`}>
          {holes.map((hole) => <i key={hole} />)}
        </span>
      ))}
    </span>
  );
}
