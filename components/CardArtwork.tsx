"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { recordNavigationDebug } from "@/lib/navigation-debug";

type CardArtworkProps = {
  name: string;
  cardNumber: string;
  setName: string;
  setSymbol: string;
  setColor: string;
  imageUrlSmall?: string | null;
  imageUrlLarge?: string | null;
  imageSource?: string | null;
  imageMatchStatus?: string;
  owned?: boolean;
  preferLarge?: boolean;
  priority?: boolean;
  className?: string;
};

export function CardArtwork({
  name,
  cardNumber,
  setName,
  setSymbol,
  setColor,
  imageUrlSmall,
  imageUrlLarge,
  imageSource,
  imageMatchStatus = "UNMATCHED",
  owned = false,
  preferLarge = false,
  priority = false,
  className = "",
}: CardArtworkProps) {
  const imageUrl = preferLarge
    ? imageUrlLarge || imageUrlSmall
    : imageUrlSmall || imageUrlLarge;
  const [state, setState] = useState<"loading" | "loaded" | "error">(
    imageUrl ? "loading" : "error",
  );
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(imageUrlLarge || imageUrlSmall || "");
  const [previewError, setPreviewError] = useState(false);
  const thumbnailRef = useRef<HTMLImageElement>(null);
  const imageStartedAtRef = useRef<number | null>(null);

  const closePreview = useCallback(() => {
    setIsPreviewOpen(false);
    setPreviewUrl("");
    setPreviewError(false);
  }, []);

  useEffect(() => {
    setState(imageUrl ? "loading" : "error");
    imageStartedAtRef.current = imageUrl && typeof performance !== "undefined" ? performance.now() : null;

    const thumbnail = thumbnailRef.current;
    if (imageUrl && thumbnail?.complete) {
      setState(thumbnail.naturalWidth > 0 ? "loaded" : "error");
      if (priority || preferLarge) {
        recordNavigationDebug("artwork:thumbnail-complete-on-mount", {
          name,
          cardNumber,
          preferLarge,
          priority,
          naturalWidth: thumbnail.naturalWidth,
        });
      }
    }
  }, [cardNumber, imageUrl, name, preferLarge, priority]);

  useEffect(() => {
    setPreviewUrl(imageUrlLarge || imageUrlSmall || "");
    setPreviewError(false);
  }, [imageUrlLarge, imageUrlSmall]);

  useEffect(() => {
    if (!isPreviewOpen) {
      return;
    }

    const previousBodyStyles = {
      overflow: document.body.style.overflow,
    };
    const previousDocumentOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePreview();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyStyles.overflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, [closePreview, isPreviewOpen]);

  function openPreview() {
    if (!imageUrlSmall && !imageUrlLarge) {
      return;
    }

    setPreviewUrl(imageUrlLarge || imageUrlSmall || "");
    setPreviewError(false);
    setIsPreviewOpen(true);
  }

  const hasImage = Boolean(imageUrl) && state !== "error";
  const sourceLabel = imageSource || imageMatchStatus.replaceAll("_", " ").toLowerCase();

  const artwork = (
    <button
      type="button"
      onClick={openPreview}
      disabled={!imageUrlSmall && !imageUrlLarge}
      className={`card-artwork-trigger card-artwork-slot relative aspect-[5/7] overflow-hidden rounded-lg border text-left ${
        owned ? "border-cyan-300/25" : "border-white/[0.1]"
      } ${owned ? "is-owned-artwork" : "is-missing-artwork"} ${hasImage ? "has-image" : "is-placeholder"} ${className}`}
      aria-label={imageUrlSmall || imageUrlLarge ? `Open large preview of ${name}` : `${name} artwork unavailable`}
    >
      {imageUrl && state !== "error" ? (
        // Native img keeps future image sources provider-agnostic until an image API is selected.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={thumbnailRef}
          src={imageUrl}
          alt={`${name} from ${setName}`}
          className={`absolute inset-0 size-full object-contain transition-opacity duration-300 ${
            state === "loaded" ? "opacity-100" : "opacity-0"
          }`}
          loading={priority ? "eager" : "lazy"}
          onLoad={() => {
            setState("loaded");
            if (priority || preferLarge) {
              recordNavigationDebug("artwork:thumbnail-loaded", {
                name,
                cardNumber,
                preferLarge,
                priority,
                elapsedMs:
                  imageStartedAtRef.current === null || typeof performance === "undefined"
                    ? null
                    : Math.round(performance.now() - imageStartedAtRef.current),
              });
            }
          }}
          onError={() => {
            setState("error");
            if (priority || preferLarge) {
              recordNavigationDebug("artwork:thumbnail-error", {
                name,
                cardNumber,
                preferLarge,
                priority,
                elapsedMs:
                  imageStartedAtRef.current === null || typeof performance === "undefined"
                    ? null
                    : Math.round(performance.now() - imageStartedAtRef.current),
              });
            }
          }}
        />
      ) : null}

      {state === "loading" ? (
        <div className="card-artwork-loading absolute inset-0" aria-hidden="true" />
      ) : null}

      {!imageUrl || state === "error" ? (
        <div className="absolute inset-0">
          <div className="absolute inset-2 rounded-md border border-white/[0.07]" />
          <span
            className={`absolute left-3 top-3 grid size-9 place-items-center rounded-md text-[10px] font-black text-slate-950 ring-1 ring-white/25 ${owned ? "shadow-glow" : "opacity-70"}`}
            style={{ backgroundColor: setColor }}
            title={setName}
          >
            {setSymbol}
          </span>
          <div className="absolute inset-x-3 bottom-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-cyan-100/45">
              {imageUrl ? "Image unavailable" : "Artwork archive"}
            </p>
            <p className="mt-1 font-mono text-xs font-black text-white/80">#{cardNumber}</p>
          </div>
        </div>
      ) : null}

      {state === "loaded" && sourceLabel ? (
        <span className="absolute bottom-2 right-2 rounded bg-slate-950/75 px-1.5 py-1 text-[8px] font-bold uppercase tracking-wide text-slate-300 backdrop-blur-sm">
          {sourceLabel}
        </span>
      ) : null}
    </button>
  );

  return (
    <>
      {artwork}
      {isPreviewOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="card-preview-backdrop"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  closePreview();
                }
              }}
            >
              <section
                className="card-preview-dialog"
                role="dialog"
                aria-modal="true"
                aria-label={`${name} card preview`}
              >
                <button
                  type="button"
                  className="card-preview-close"
                  onClick={closePreview}
                  aria-label="Close card preview"
                  autoFocus
                >
                  <span aria-hidden="true">×</span>
                </button>

                <div className="card-preview-image-stage">
                  {!previewError && previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt={`${name} from ${setName}`}
                      className="card-preview-image"
                      onError={() => {
                        if (previewUrl !== imageUrlSmall && imageUrlSmall) {
                          setPreviewUrl(imageUrlSmall);
                        } else {
                          setPreviewError(true);
                        }
                      }}
                    />
                  ) : (
                    <div className="card-preview-missing">
                      <span
                        className="grid size-12 place-items-center rounded-md text-sm font-black text-slate-950 ring-1 ring-white/25"
                        style={{ backgroundColor: setColor }}
                      >
                        {setSymbol}
                      </span>
                      <p>High-resolution image unavailable</p>
                    </div>
                  )}
                </div>

                <footer className="card-preview-caption">
                  <div>
                    <p className="text-xs font-bold text-cyan-100/65">{setName} · #{cardNumber}</p>
                    <h2 className="mt-1 text-lg font-black text-white">{name}</h2>
                  </div>
                  <p className="text-xs font-semibold text-slate-500">Click outside or press ESC to close</p>
                </footer>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
