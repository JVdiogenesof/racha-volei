type ArtWatermarkProps = {
  src: string;
};

/** A marca d'água comum às artes compartilháveis do VPA. */
export function ArtWatermark({ src }: ArtWatermarkProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={1920}
      height={1920}
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        // Afastada (contain, não cover): a logo inteira aparece atrás do
        // conteúdo, sem cortar nenhuma borda, só um pouco menor que o
        // story pra sobrar respiro ao redor.
        width: "82%",
        height: "82%",
        objectFit: "contain",
        opacity: 0.09,
      }}
    />
  );
}
