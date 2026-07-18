import type { TimelineItem } from "@/lib/entities";
import { formatDate } from "@/lib/utils";

export function Timeline({ timeline }: { timeline: TimelineItem[] }) {
  if (!timeline.length) {
    return (
      <section className="rounded-md border border-[#e6e0d8] bg-[#202124] p-5 text-sm font-medium text-white/70 shadow-sm">
        No timeline items yet.
      </section>
    );
  }

  return (
    <section className="rounded-md border border-[#e6e0d8] bg-[#202124] p-5 text-white shadow-sm">
      <div className="space-y-5">
        {timeline.map((item) => (
          <article key={item.id} className="border-l border-[#6d7777] pl-4">
            <p className="text-sm font-medium text-[#c6d7d2]">{formatDate(item.date)}</p>
            <h3 className="mt-1 text-xl font-semibold tracking-normal">{item.title}</h3>
            <p className="mt-1 leading-7 text-[#e6e0d8]">{item.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
