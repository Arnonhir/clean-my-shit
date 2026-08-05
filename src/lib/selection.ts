export interface SelectedItem {
  absPath: string;
  recursive: boolean;
  size: number;
}

export type SelectionMap = Map<string, SelectedItem>;
