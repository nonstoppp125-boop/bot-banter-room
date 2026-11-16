export interface WranglerD1Binding {
  binding: string;
  database_name: string;
  database_id: string;
  migrations_dir?: string;
  [key: string]: unknown;
}

export interface WranglerConfig {
  d1_databases?: WranglerD1Binding[];
  secrets?: {
    required?: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export function addProductionD1Binding(
  config: WranglerConfig,
  options: {
    configPath: string;
    databaseName?: string;
    databaseId?: string;
    projectRoot?: string;
  },
): WranglerConfig & {
  d1_databases: WranglerD1Binding[];
  secrets: { required: string[]; [key: string]: unknown };
};
