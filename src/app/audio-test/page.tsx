"use client";

import { AudioPlayer } from '@/components/AudioPlayer';

export default function AudioTestPage() {

    return (
        <div className="p-8 max-w-2xl mx-auto font-sans">
            <h1 className="text-2xl font-bold mb-6">Audio Integration Test</h1>

            <p className="mb-4">
                This page demonstrates the usage of the AudioPlayer component.
            </p>

            {/* Example 1: Functioning Reference */}
            <div className="border p-4 mb-4 rounded bg-charcoal-50 border-charcoal-200">
                <div className="font-semibold text-saffron-700">Reference: Vach.Sā.1</div>
                <div className="my-2">
                    <AudioPlayer reference="Vach.Sā.1" />
                </div>
                <p className="text-charcoal-700">
                    Lorem ipsum dolor sit amet, referencing Vachanamrut Sarangpur 1.
                </p>
            </div>

            {/* Example 2: Functioning Reference (Swamini Vato) */}
            <div className="border p-4 mb-4 rounded bg-charcoal-50 border-charcoal-200">
                <div className="font-semibold text-saffron-700">Reference: Swā.Vāto: 1/26</div>
                <div className="my-2">
                    <AudioPlayer reference="Swā.Vāto: 1/26" />
                </div>
                <p className="text-charcoal-700">
                    More text referencing Swamini Vato 1/26.
                </p>
            </div>

            {/* Example 3: Missing Mapping (Should handle gracefully) */}
            <div className="border p-4 mb-4 rounded bg-red-50">
                <div className="font-semibold text-red-700">Reference: Unknown.Ref (Missing)</div>
                <div className="my-2">
                    <AudioPlayer reference="Unknown.Ref" />
                </div>
                <p className="text-charcoal-700">
                    This reference has no mapping, so 'Coming Soon' should appear.
                </p>
            </div>

        </div>
    );
}
