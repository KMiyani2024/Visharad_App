import Link from "next/link";
import fs from "fs/promises";
import path from "path";
import { ArrowRight, BookOpen, GraduationCap } from "lucide-react";

async function getMiniReviews() {
  const quizzesDir = path.join(process.cwd(), "public", "quizzes");
  try {
    const files = await fs.readdir(quizzesDir);
    const miniReviews = files
      .filter((file) => file.startsWith("mini_review_") && file.endsWith(".json"))
      .map((file) => {
        const match = file.match(/mini_review_(\d+)\.json/);
        return match ? parseInt(match[1]) : 0;
      })
      .sort((a, b) => a - b);
    return miniReviews;
  } catch (error) {
    console.error("Error reading quizzes directory:", error);
    return [];
  }
}

export default async function TestYourselfPage() {
  const miniReviews = await getMiniReviews();

  return (
    <div className="max-w-4xl mx-auto sm:p-2">
      <div className="mb-10 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5 bg-saffron-50 text-saffron-700 text-xs font-semibold tracking-wide uppercase">
          <BookOpen size={14} />
          Mini Reviews
        </div>
        <h1 className="text-4xl font-display font-extrabold text-charcoal-900 mb-4">
          Test Yourself
        </h1>
        <p className="text-lg text-charcoal-500">
          Challenge yourself with mini-reviews covering multiple classes.
        </p>
      </div>

      {/* Final Exam signpost */}
      <Link
        href="/final-exam"
        className="group mb-6 flex items-center gap-4 rounded-2xl border border-saffron-200 bg-saffron-50 p-5 hover:border-saffron-300 hover:shadow-md transition-all"
      >
        <div className="p-3 rounded-xl bg-saffron-500 text-white shrink-0">
          <GraduationCap size={24} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-display font-bold text-charcoal-900">Preparing for the Final Exam?</h2>
          <p className="text-sm text-charcoal-600">Four papers, 100 marks — what to revise and how each paper is marked.</p>
        </div>
        <ArrowRight size={20} className="shrink-0 text-saffron-600 group-hover:translate-x-1 transition-transform" />
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {miniReviews.map((id) => {
          const startClass = Math.max(1, id - 4);
          const endClass = id;
          return (
            <Link
              key={id}
              href={`/test-yourself/${id}`}
              className="group relative bg-card rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-charcoal-100 hover:border-saffron-300 hover:-translate-y-0.5"
            >
              <div className="p-7">
                <div className="flex items-start justify-between mb-6">
                  <div className="p-3 bg-saffron-50 rounded-xl text-saffron-600 group-hover:scale-110 group-hover:bg-saffron-100 transition-all duration-300">
                    <BookOpen size={28} />
                  </div>
                  <div className="p-2 rounded-full bg-charcoal-50 text-charcoal-400 group-hover:bg-saffron-500 group-hover:text-white transition-colors duration-300">
                    <ArrowRight size={18} />
                  </div>
                </div>

                <h2 className="text-xl font-display font-bold text-charcoal-800 mb-2 group-hover:text-saffron-600 transition-colors">
                  Mini-Review {startClass}-{endClass}
                </h2>
                <p className="text-charcoal-500 text-sm leading-relaxed">
                  Comprehensive review covering material from classes {startClass} to{" "}
                  {endClass}.
                </p>
              </div>
              <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-saffron-400 to-saffron-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
            </Link>
          );
        })}

        {miniReviews.length === 0 && (
          <div className="col-span-full text-center py-12 bg-charcoal-50/50 rounded-2xl border border-dashed border-charcoal-200">
            <p className="text-charcoal-500">
              No mini-reviews available yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
