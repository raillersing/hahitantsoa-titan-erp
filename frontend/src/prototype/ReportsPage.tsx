import ReportsDashboard from "./ReportsDashboard";

interface ReportsPageProps {
  onNavigate: (scope: any, param?: string) => void;
}

export default function ReportsPage({ onNavigate }: ReportsPageProps) {
  return <ReportsDashboard onNavigate={onNavigate} />;
}
