import { DestinationMap } from "../components/DestinationMap";
import { places } from "../lib/content";

export function MapPage() {
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
    <section className="map-stage">
      <DestinationMap
        className="map-stage__map"
        destinations={destinations}
        onSelect={(place) => {
          window.location.href = `/map/${place.slug}`;
        }}
      />
      <h1 className="map-stage__title page-title font-serif">Destinations on Map</h1>
      <nav className="map-stage__places" aria-label="地图地点列表">
        <h2>Browse places</h2>
        <ul>
          {destinations.map((place) => (
            <li key={place.id}>
              <a href={`/map/${place.slug}`}>
                {place.name}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}
