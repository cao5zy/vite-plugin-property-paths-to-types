import { describe, it, expect } from 'vitest';
import { generateTypeNameFromPath } from '../generator.js';

describe('generateTypeNameFromPath', () => {
  it('应该将简单的属性路径转换为PascalCase', () => {
    expect(generateTypeNameFromPath('user')).toBe('User');
    expect(generateTypeNameFromPath('userName')).toBe('UserName');
  });

  it('应该将嵌套的属性路径转换为PascalCase', () => {
    expect(generateTypeNameFromPath('user.profile')).toBe('Profile');
    expect(generateTypeNameFromPath('api.config.database')).toBe('Database');
  });

  it('应该正确处理带前缀和后缀的类型名称', () => {
    expect(generateTypeNameFromPath('user', 'I', 'Config')).toBe('IUserConfig');
    expect(generateTypeNameFromPath('api.config', 'T', 'Type')).toBe('TConfigType');
  });

  it('应该处理空路径', () => {
    expect(generateTypeNameFromPath('')).toBe('');
    expect(generateTypeNameFromPath('', 'I', 'Type')).toBe('IType');
  });

  it('应该处理单字符路径段', () => {
    expect(generateTypeNameFromPath('a.b.c')).toBe('C');
  });

  it('应该保持纯函数的特性 - 相同的输入总是返回相同的输出', () => {
    const path = 'user.profile.settings';
    const prefix = 'I';
    const suffix = 'Type';
    
    const result1 = generateTypeNameFromPath(path, prefix, suffix);
    const result2 = generateTypeNameFromPath(path, prefix, suffix);
    
    expect(result1).toBe(result2);
    expect(result1).toBe('ISettingsType');
  });
});
