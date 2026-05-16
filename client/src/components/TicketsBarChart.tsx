import type { TicketsPerDayResponse } from "@helpdesk/core";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const chartConfig = {
  count: { label: "Tickets", color: "var(--chart-1)" },
} satisfies ChartConfig;

function formatDate(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function TicketsBarChart({ data }: { data: TicketsPerDayResponse }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const avg = total / Math.max(data.length, 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
        <div>
          <p className="label-meta">Volume · 30 days</p>
          <p className="display-serif tabular text-[40px] leading-none text-foreground mt-1.5">
            {total.toLocaleString()}
          </p>
        </div>
        <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          Daily avg · <span className="tabular text-foreground">{avg.toFixed(1)}</span>
        </div>
        <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          Peak · <span className="tabular text-foreground">{maxCount}</span>
        </div>
      </div>

      <ChartContainer config={chartConfig} className="h-60 w-full">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
          <CartesianGrid
            vertical={false}
            strokeDasharray="2 4"
            className="stroke-border"
          />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tick={{
              fontSize: 10,
              fontFamily: "JetBrains Mono Variable, monospace",
              fill: "var(--muted-foreground)",
            }}
            tickFormatter={formatDate}
            interval={Math.floor(data.length / 6)}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{
              fontSize: 10,
              fontFamily: "JetBrains Mono Variable, monospace",
              fill: "var(--muted-foreground)",
            }}
            allowDecimals={false}
            domain={[0, maxCount]}
            width={28}
          />
          <ChartTooltip
            cursor={{ fill: "var(--accent)", opacity: 0.4 }}
            content={
              <ChartTooltipContent
                labelFormatter={(label) => formatDate(String(label))}
              />
            }
          />
          <Bar
            dataKey="count"
            fill="var(--color-count)"
            radius={[2, 2, 0, 0]}
            maxBarSize={28}
          />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
