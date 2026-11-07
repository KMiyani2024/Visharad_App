import Image from 'next/image';

/** The Akshar-Purushottam Sanskrit Pathshala seal (from overview.pathshala.baps.solutions). */
export function PathshalaSeal({ size = 34, className = '' }: { size?: number; className?: string }) {
    return (
        <Image
            src="/pathshala-seal.svg"
            alt="Akshar-Purushottam Sanskrit Pathshala"
            width={size}
            height={size}
            priority
            className={`seal-ring shrink-0 rounded-full ${className}`}
        />
    );
}
