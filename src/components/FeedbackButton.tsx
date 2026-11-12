'use client';

import { useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { FeedbackModal } from './FeedbackModal';
import { usePathname } from 'next/navigation';

export function FeedbackButton() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const pathname = usePathname();

    return (
        <>
            {/* Lives in the top bar (it used to float over page content). */}
            <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="group flex h-9 items-center gap-1.5 rounded-full border border-saffron-200 bg-saffron-50 px-2.5 lg:px-3.5 text-[13px] font-semibold text-saffron-700 transition-all hover:bg-saffron-100 active:scale-95"
                aria-label="Give feedback"
                title="Give feedback"
            >
                <MessageSquarePlus size={17} className="group-hover:rotate-12 transition-transform duration-300" />
                <span className="hidden lg:inline">Feedback</span>
            </button>

            <FeedbackModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmitSuccess={() => setIsModalOpen(false)}
                pageUrl={pathname}
            />
        </>
    );
}
