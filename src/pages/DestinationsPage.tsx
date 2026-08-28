import { DestinationMap } from "../components/DestinationMap";
import { places } from "../lib/content";

export function DestinationsPage() {
  const destinations = places.map((place) => ({
    id: place.id,
    slug: place.slug,
    name: place.name,
    kind: place.kind,
    parentId: place.parentId,
    center: [place.coordinates.longitude, place.coordinates.latitude] as [
      number,
      number,
    ],
    geometry: place.geometry,
  }));

  return (
    <section className="destinations-stage">
      <DestinationMap
        className="destinations-stage__map"
        destinations={destinations}
        onSelect={(place) => {
          window.location.href = `/destinations/${place.slug}`;
        }}
      />
      <div className="destinations-stage__intro">
        <h1 className="page-title font-serif">Destinations</h1>
        <p className="page-intro">
          在地图上回看那些曾经停留的地方。
        </p>
      </div>
      <nav className="destinations-stage__fallback" aria-label="目的地列表">
        <h2>Browse destinations</h2>
        <ul>
          {destinations.map((place) => (
            <li key={place.id}>
              <a href={`/destinations/${place.slug}`}>
                {place.name}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}
