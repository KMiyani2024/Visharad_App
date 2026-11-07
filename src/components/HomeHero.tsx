'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, Headphones, Library, ListChecks } from 'lucide-react';
import { DharmaFlag } from './DharmaFlag';
import { fadeInUp, staggerContainer } from '@/lib/motion';

type HomeHeroProps = {
    startLink: string;
    totalClasses: number;
    totalShloks: number;
};

export function HomeHero({ startLink, totalClasses, totalShloks }: HomeHeroProps) {
    const stats = [
        { label: 'Classes', value: totalClasses, icon: Library },
        { label: 'Shloks', value: totalShloks, icon: BookOpen },
        { label: 'Audio Recitations', value: '∞', icon: Headphones },
        { label: 'Practice Quizzes', value: totalClasses, icon: ListChecks },
    ];

    return (
        <div className="space-y-10 md:space-y-14">
            <div className="scale-fixed relative flex flex-col items-center justify-center min-h-[64vh] md:min-h-[70vh] text-center px-4 rounded-3xl overflow-hidden shadow-2xl shadow-black/20">
                {/* Background Image */}
                <Image
                    src="/new_banner.jpg"
                    alt="Visharad Sahayak Banner"
                    fill
                    className="object-cover object-center z-0"
                    priority
                />

                {/* Duotone overlay: charcoal base + saffron glow */}
                <div className="absolute inset-0 z-10 bg-gradient-to-b from-charcoal-950/85 via-charcoal-950/70 to-charcoal-950/90" />
                <div className="absolute inset-0 z-10 bg-gradient-to-tr from-saffron-900/30 via-transparent to-transparent" />
                <div className="absolute inset-0 z-10 bg-dot-grid opacity-[0.06]" />

                {/* Corner flag accents */}
                <DharmaFlag className="hidden sm:block absolute top-6 left-6 z-20 w-6 h-10 text-charcoal-400/60 opacity-80" />
                <DharmaFlag className="hidden sm:block absolute bottom-6 right-6 z-20 w-6 h-10 text-charcoal-400/60 opacity-80 rotate-180" />

                {/* Content */}
                <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="show"
                    className="relative z-20 flex flex-col items-center max-w-2xl mx-auto"
                >
                    <motion.div
                        variants={fadeInUp}
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 bg-white/10 backdrop-blur-md border border-saffron-400/30 text-saffron-200 text-xs font-semibold tracking-wide uppercase"
                    >
                        <BookOpen size={14} />
                        Satsang Diksha Study Companion
                    </motion.div>

                    <motion.h1
                        variants={fadeInUp}
                        className="text-balance text-5xl md:text-7xl font-display font-extrabold text-white mb-5 tracking-tight drop-shadow-xl"
                    >
                        Visharad Sahayak
                    </motion.h1>

                    <motion.p
                        variants={fadeInUp}
                        className="text-lg md:text-xl text-charcoal-100/90 max-w-lg mb-10 leading-relaxed font-medium"
                    >
                        Study support for Vidvāns — read, listen, and test your grasp of every shlok.
                    </motion.p>

                    <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4">
                        <Link
                            href={startLink}
                            className="group inline-flex items-center justify-center px-9 py-3.5 text-base font-bold text-charcoal-950 bg-gradient-to-r from-saffron-400 to-saffron-500 rounded-full hover:from-saffron-300 hover:to-saffron-400 transition-all shadow-xl shadow-saffron-900/30 hover:shadow-saffron-500/40 hover:-translate-y-0.5"
                        >
                            Start Studying
                            <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={20} />
                        </Link>

                        <Link
                            href="/test-yourself"
                            className="group inline-flex items-center justify-center px-9 py-3.5 text-base font-bold text-white bg-white/10 border border-white/20 backdrop-blur-md rounded-full hover:bg-white/20 transition-all hover:-translate-y-0.5"
                        >
                            Test Yourself
                            <ListChecks className="ml-2 group-hover:translate-x-1 transition-transform" size={20} />
                        </Link>
                    </motion.div>
                </motion.div>
            </div>

            {/* Stat / feature strip */}
            <motion.div
                variants={staggerContainer}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: '-60px' }}
                className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4"
            >
                {stats.map((stat) => (
                    <motion.div
                        key={stat.label}
                        variants={fadeInUp}
                        className="flex flex-col items-center text-center gap-2 p-5 rounded-2xl bg-card border border-charcoal-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
                    >
                        <div className="p-2.5 rounded-xl bg-saffron-50 text-saffron-600">
                            <stat.icon size={20} />
                        </div>
                        <div className="text-2xl font-display font-extrabold text-charcoal-900">{stat.value}</div>
                        <div className="text-xs font-medium text-charcoal-500 uppercase tracking-wide">{stat.label}</div>
                    </motion.div>
                ))}
            </motion.div>
        </div>
    );
}
