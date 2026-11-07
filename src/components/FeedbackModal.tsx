'use client';

import { useState } from 'react';
import { Star, X } from 'lucide-react';

type FeedbackModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSubmitSuccess: () => void;
    pageUrl: string;
};

export function FeedbackModal({ isOpen, onClose, onSubmitSuccess, pageUrl }: FeedbackModalProps) {
    // State for the 5 questions
    const [overallRating, setOverallRating] = useState<number>(0); // 1. Overall Experience (Rating)
    const [confusingParts, setConfusingParts] = useState('');      // 2. Confusing parts (Text)
    const [featureRequest, setFeatureRequest] = useState('');      // 3. Feature Request (Text)
    const [navRating, setNavRating] = useState<number>(0);         // 4. Navigation Ease (Rating)
    const [generalComment, setGeneralComment] = useState('');      // 5. General Comment (Text)

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        // Validation: Ensure at least the main rating is provided? 
        // User didn't specify strict validation, but "Overall Rating" usually implies mandatory.
        // Let's make Overall Rating mandatory, rest optional to reduce friction.
        if (overallRating === 0) {
            setError('Please provide an overall rating.');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    responses: {
                        overallRating,
                        confusingParts,
                        featureRequest,
                        navRating,
                        generalComment
                    },
                    pageUrl
                })
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                throw new Error(data?.error || 'Failed to submit feedback');
            }

            // Reset form
            setOverallRating(0);
            setConfusingParts('');
            setFeatureRequest('');
            setNavRating(0);
            setGeneralComment('');

            onSubmitSuccess();
        } catch (err) {
            console.error(err);
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('Something went wrong. Please try again.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const renderStars = (rating: number, setRating: (r: number) => void) => (
        <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    onClick={() => setRating(star)}
                    className="focus:outline-none transition-transform hover:scale-110 active:scale-95"
                    type="button"
                >
                    <Star
                        size={28}
                        className={`${star <= rating ? 'fill-saffron-400 text-saffron-400' : 'text-charcoal-200'} transition-colors duration-200`}
                    />
                </button>
            ))}
        </div>
    );

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card border border-charcoal-100 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="bg-saffron-50 px-6 py-4 border-b border-saffron-100 flex justify-between items-center shrink-0">
                    <h3 className="text-lg font-semibold text-saffron-900">
                        Your Feedback Matters
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-saffron-800/60 hover:text-saffron-900 hover:scale-110 transition-all"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body - Scrollable */}
                <div className="p-6 space-y-8 overflow-y-auto">

                    {/* Q1: Overall Rating */}
                    <div className="space-y-3 text-center">
                        <label className="block text-base font-medium text-charcoal-800">
                            Overall, how would you rate your experience with the app so far?
                        </label>
                        {renderStars(overallRating, setOverallRating)}
                    </div>

                    {/* Q2: Confusing Parts */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-charcoal-700">
                            Was there anything that felt confusing or hard to understand?
                        </label>
                        <textarea
                            rows={2}
                            className="w-full px-3 py-2 border border-charcoal-200 rounded-lg focus:ring-2 focus:ring-saffron-500/20 focus:border-saffron-500 transition-all resize-none text-sm bg-card text-charcoal-900 placeholder-charcoal-400 outline-none"
                            placeholder="e.g., finding the quizzes..."
                            value={confusingParts}
                            onChange={(e) => setConfusingParts(e.target.value)}
                        />
                    </div>

                    {/* Q3: Feature Request */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-charcoal-700">
                            What is one feature we could add to make the app more useful for you?
                        </label>
                        <textarea
                            rows={2}
                            className="w-full px-3 py-2 border border-charcoal-200 rounded-lg focus:ring-2 focus:ring-saffron-500/20 focus:border-saffron-500 transition-all resize-none text-sm bg-card text-charcoal-900 placeholder-charcoal-400 outline-none"
                            placeholder="e.g., daily reminders..."
                            value={featureRequest}
                            onChange={(e) => setFeatureRequest(e.target.value)}
                        />
                    </div>

                    {/* Q4: Navigation Rating */}
                    <div className="space-y-3 text-center">
                        <label className="block text-sm font-medium text-charcoal-700">
                            How easy is it to navigate the app and find what you need?
                        </label>
                        {renderStars(navRating, setNavRating)}
                    </div>

                    {/* Q5: General Comment */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-charcoal-700">
                            Any other comments or suggestions?
                        </label>
                        <textarea
                            rows={3}
                            className="w-full px-3 py-2 border border-charcoal-200 rounded-lg focus:ring-2 focus:ring-saffron-500/20 focus:border-saffron-500 transition-all resize-none text-sm bg-card text-charcoal-900 placeholder-charcoal-400 outline-none"
                            placeholder="Tell us anything else..."
                            value={generalComment}
                            onChange={(e) => setGeneralComment(e.target.value)}
                        />
                    </div>

                    {error && (
                        <p className="text-sm text-red-600 bg-red-50 p-2 rounded-md text-center">
                            {error}
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-charcoal-50 px-6 py-4 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end border-t border-charcoal-100 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-charcoal-600 hover:text-charcoal-800 hover:bg-charcoal-100 hover:scale-105 rounded-lg transition-all"
                        disabled={submitting}
                    >
                        Close
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting || overallRating === 0}
                        className="px-6 py-2 text-sm font-medium text-white bg-saffron-500 hover:bg-saffron-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 rounded-lg shadow-sm hover:shadow-lg shadow-saffron-600/20 hover:scale-105 transition-all active:scale-95"
                    >
                        {submitting ? 'Sending...' : 'Submit Feedback'}
                    </button>
                </div>
            </div>
        </div>
    );
}
