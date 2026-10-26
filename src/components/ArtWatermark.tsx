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
        inset: "0",
        width: "100%",
        height: "100%",
        objectFit: "cover",
        // Logo quadrada num story vertical: o recorte é só na largura (a
        // altura inteira sempre aparece), então centralizado de verdade é
        // o brasão no meio da faixa visível.
        objectPosition: "center",
        opacity: 0.09,
      }}
    />
  );
}
