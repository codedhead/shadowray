
export interface FileInfo {
  shaderStage: number;
  name: string;
  filename: string;
  path: string; // for monaco
  code: string;
}

export interface AppId {
  id: string;
  name: string;
}

export interface AppInfo {
  id: string;
  name: string;
  commonCode?: FileInfo;
  sceneConfig: FileInfo;
  shaders: FileInfo[];
}
