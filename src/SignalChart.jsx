import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
export default function SignalChart({ rows, labels }) {
  if (!rows.length)
    return <p className="empty">No tags match these filters.</p>;
  return (
    <div
      className="chart"
      role="img"
      aria-label="Tag counts among returned entities. Exact values are in the signal table below."
    >
      <ResponsiveContainer width="100%" height={290}>
        <BarChart
          data={rows.slice(0, 6)}
          layout="vertical"
          margin={{ left: 12, right: 25 }}
        >
          <CartesianGrid stroke="#e3e8e4" horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fill: "#66716c", fontSize: 11 }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={130}
            tick={{ fill: "#49584f", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "#ffffff",
              border: "1px solid #dce3dc",
              color: "#1c2b24",
            }}
          />
          <Bar
            dataKey="a"
            name={labels[0]}
            fill="#245d4b"
            radius={[0, 3, 3, 0]}
          />
          <Bar
            dataKey="b"
            name={labels[1]}
            fill="#bd7766"
            radius={[0, 3, 3, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
