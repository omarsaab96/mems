import { CalendarDays } from "lucide-react";
import type { Memory } from "@/lib/entities";
import { formatDate } from "@/lib/utils";

export function Memories({ memories }: { memories: Memory[] }) {
  if (!memories.length) {
    return (
      <div className="rounded-md border border-[#e6e0d8] bg-white p-5 text-sm font-medium text-[#6b7177] shadow-sm max-[1300px]:p-4">
        No memories yet.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 max-[1300px]:gap-3">
      {memories.map((memory) => (
        <article key={memory.id} className="rounded-md border border-[#e6e0d8] bg-white p-5 shadow-sm max-[1300px]:p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-[#6b7177]">
            <CalendarDays size={15} aria-hidden="true" />
            {formatDate(memory.date)}
          </p>
          <h3 className="mt-3 text-2xl font-semibold tracking-normal max-[1300px]:text-xl">{memory.title}</h3>
          <p className="mt-2 leading-7 text-[#5f666d]">{memory.description}</p>
        </article>
      ))}
    </div>
  );
}
