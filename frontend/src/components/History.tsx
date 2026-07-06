import { CalendarDays, CheckCircle2, Gauge, Sparkles } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { HistoryData } from "../api";

export function History({ data }: { data: HistoryData | null }) {
  if (!data || !data.events.length) {
    return (
      <section className="empty-history">
        <span><Sparkles /></span>
        <h2>Your progress starts here</h2>
        <p>Complete a coaching session and your posture trends will appear here.</p>
      </section>
    );
  }
  const chart = data.events.map((event) => ({
    ...event,
    time: new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  }));
  return (
    <>
      <div className="metric-grid">
        <Metric icon={<CheckCircle2 />} label="Good posture" value={`${data.summary.good_posture_percent}%`} />
        <Metric icon={<Gauge />} label="Average score" value={`${data.summary.average_score}`} />
        <Metric icon={<CalendarDays />} label="Sessions" value={`${data.summary.sessions}`} />
      </div>
      <section className="chart-card">
        <div>
          <p className="eyebrow">Recent activity</p>
          <h2>Posture score over time</h2>
          <p>Lower is better. Small changes become visible after a few sessions.</p>
        </div>
        <div className="chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart}>
              <CartesianGrid stroke="#e8ece6" vertical={false} />
              <XAxis dataKey="time" axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 14, border: "1px solid #dde5da" }} />
              <Line type="monotone" dataKey="score" stroke="#2f6953" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <article className="metric-card">
      <span>{icon}</span><div><p>{label}</p><strong>{value}</strong></div>
    </article>
  );
}

