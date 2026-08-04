import type { DashboardCriteria, DashboardSummary } from "../domain/dashboard";

export interface DashboardRepository {
  summarize(criteria: DashboardCriteria): Promise<DashboardSummary>;
}
