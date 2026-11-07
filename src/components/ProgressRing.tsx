type ProgressRingProps = {
    progress: number; // 0..1
    size?: number;
    strokeWidth?: number;
    className?: string;
};

export function ProgressRing({ progress, size = 18, strokeWidth = 2.5, className = '' }: ProgressRingProps) {
    const clamped = Math.min(1, Math.max(0, progress));
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - clamped);

    return (
        <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className={`shrink-0 -rotate-90 ${className}`}
            aria-hidden="true"
        >
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                className="text-charcoal-200"
            />
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="text-saffron-500 transition-[stroke-dashoffset] duration-500 ease-out"
            />
        </svg>
    );
}
