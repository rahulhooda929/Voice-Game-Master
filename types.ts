export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  timestamp: Date;
  isPartial?: boolean;
}

export type UniverseType = 'fantasy' | 'scifi' | 'noir' | 'post-apoc';

export interface UniverseConfig {
  id: UniverseType;
  title: string;
  description: string;
  icon: string; // Emoji or icon name
  initialPrompt: string;
  color: string; // Tailwind color class stub
  voiceName: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
}

export interface AudioVisualizerState {
  volume: number; // 0 to 1
  isActive: boolean;
}
