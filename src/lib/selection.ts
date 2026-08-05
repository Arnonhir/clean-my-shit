export interface SelectedItem {
  name: string;
  parentHandle: FileSystemDirectoryHandle;
  recursive: boolean;
  size: number;
}

export type SelectionMap = Map<string, SelectedItem>;
