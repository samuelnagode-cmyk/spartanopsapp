import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface WoodCarouselProps {
  images: string[];
  alt: string;
  children?: React.ReactNode;
}

export default function WoodCarousel({ images, alt, children }: WoodCarouselProps) {
  const [i, setI] = useState(0);
  const prev = () => setI((p) => (p - 1 + images.length) % images.length);
  const next = () => setI((p) => (p + 1) % images.length);

  const navBtn =
    "absolute top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 ease-out active:scale-[0.92] focus:outline-none focus-visible:shadow-[0_0_0_2px_rgba(255,255,255,0.6)]";
  const navStyle: React.CSSProperties = {
    background: "rgba(0, 0, 0, 0.28)",
    border: "0.5px solid rgba(255, 255, 255, 0.18)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
  };

  return (
    <div className="relative rounded-xl overflow-hidden aspect-[4/3] group">
      {images.map((src, idx) => (
        <img
          key={src}
          src={src}
          alt={`${alt} ${idx + 1}`}
          loading="lazy"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
            idx === i ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
      {children}

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label="Prejšnja slika"
            style={navStyle}
            className={`${navBtn} left-3 hover:[background:rgba(0,0,0,0.4)] hover:[border-color:rgba(255,255,255,0.25)]`}
          >
            <ChevronLeft size={14} strokeWidth={1.5} className="text-white/95" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Naslednja slika"
            style={navStyle}
            className={`${navBtn} right-3 hover:[background:rgba(0,0,0,0.4)] hover:[border-color:rgba(255,255,255,0.25)]`}
          >
            <ChevronRight size={14} strokeWidth={1.5} className="text-white/95" />
          </button>


          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex gap-1.5">
            {images.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setI(idx)}
                aria-label={`Go to image ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  idx === i ? "w-6 bg-cream" : "w-1.5 bg-cream/50"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
