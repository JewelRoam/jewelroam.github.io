import { DestinationMap } from "../components/DestinationMap";
import { places } from "../lib/content";

export function DestinationsPage() {
  const destinations = places.map((place) => ({
    id: place.id,
    slug: place.slug,
    name: place.name,
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
        <h1 className="font-serif text-5xl">Destinations</h1>
        <p className="mt-5 leading-7 text-[#20211f]/65">
          在地图上回看那些曾经停留的地方。
        </p>
      </div>
    </section>
  );
}
