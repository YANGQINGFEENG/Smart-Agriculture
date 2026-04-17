// 工具函数模块
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * 合并CSS类名的工具函数
 * 用于处理条件类名和Tailwind类名的合并
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
