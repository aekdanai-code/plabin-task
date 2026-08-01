import Image from "next/image";

export function BrandLogo({ size = 40, priority = false }: { size?: number; priority?: boolean }) {
  return (
    <Image
      src="/logo.png"
      alt="Plabin Task"
      width={size}
      height={size}
      priority={priority}
      className="shrink-0 rounded-lg object-cover"
    />
  );
}
