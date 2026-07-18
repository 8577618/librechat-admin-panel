/**
 * Ensures every config field extracted from the schema has a matching
 * locale key in translation.json.  Catches fields that would render
 * their raw key (e.g. `com_config_field_thinkingLevel`) in the UI.
 */
import { describe, it, expect } from 'vitest';
import { configSchema } from 'librechat-data-provider';
import type { ZodSchemaLike } from '@/types/config';
import { extractSchemaTree, flattenTree } from '@/server/config';
import translation from '@/locales/en/translation.json';
import translationZhCN from '@/locales/zh-CN/translation.json';

const localeKeys = new Set(Object.keys(translation));

const zhCNGlossary = {
  com_a11y_logo_alt: 'LibreChat 标志',
  com_access_active: '已启用',
  com_access_col_name: '名称',
  com_access_tab_groups: '群组',
  com_cap_cat_groups: '群组',
  com_cap_col_name: '名称',
  com_cap_col_status: '状态',
  com_cap_edit_title: '编辑 {{name}} 的能力',
  com_cap_empty: '未找到拥有能力的主体',
  com_cap_principal_unavailable: '该主体已不可用',
  com_cap_subtitle: '管理拥有系统级能力的主体',
  com_config_field_agents: '智能体',
  com_config_field_anthropic: 'Anthropic',
  com_config_field_avatar: '头像',
  com_config_field_azureAssistants: 'Azure Assistants',
  com_config_field_azureOpenAI: 'Azure OpenAI',
  com_config_field_bedrock: 'Amazon Bedrock',
  com_config_field_custom: '自定义',
  com_config_field_enforce: '强制执行',
  com_config_field_google: 'Google',
  com_config_field_group: '群组',
  com_config_field_groups: '群组',
  com_config_field_modelSpecs: '模型规格',
  com_config_field_openAI: 'OpenAI',
  com_config_field_openai: 'OpenAI',
  com_config_field_scraperProvider: '网页抓取提供商',
  com_config_field_scraperTimeout: '网页抓取超时',
  com_config_field_strategy: '策略',
  com_config_field_stream: '流式传输',
  com_config_field_streamRate: '流式输出速率',
  com_config_field_timeout: '超时',
  com_config_field_titleConvo: '生成对话标题',
  com_config_field_vertex: 'Google Vertex AI',
  com_config_section_ai_providers: 'AI 提供商',
  com_config_section_model_specs: '模型规格',
  com_config_tab_ai_providers: 'AI 提供商',
  com_config_tab_features: '功能',
  com_config_tab_model_specs: '模型规格',
  com_dash_nav_tips: '使用指南',
  com_grants_capability_count: '{{count}} 项能力',
  com_grants_no_capabilities: '无已授权能力',
  com_grants_subtitle: '按角色管理系统级能力',
  com_grants_tab_management: '授权管理',
  com_grants_title: '系统授权',
  com_help_discord_title: 'Discord',
  com_kv_type_boolean: '真/假',
  com_nav_grants: '授权',
  com_nav_groups: '群组',
  com_ui_active: '已启用',
  com_ui_dark_theme_enabled: '已启用深色主题',
};

function interpolationTokens(value: string): string[] {
  return [...value.matchAll(/{{\s*[^}]+\s*}}|\$\{[^}]+\}/g)].map((match) => match[0]).sort();
}

describe('config field localization coverage', () => {
  const tree = extractSchemaTree(configSchema as ZodSchemaLike);
  const allFields = flattenTree(tree);

  it('keeps Simplified Chinese complete and interpolation-safe', () => {
    expect(Object.keys(translationZhCN).sort()).toEqual(Object.keys(translation).sort());
    for (const key of Object.keys(translation)) {
      expect(interpolationTokens(translationZhCN[key])).toEqual(
        interpolationTokens(translation[key]),
      );
    }
  });

  it('uses the approved Chinese admin terminology', () => {
    for (const [key, value] of Object.entries(zhCNGlossary)) {
      expect(translationZhCN[key as keyof typeof translationZhCN]).toBe(value);
    }
  });

  it('every schema field has a com_config_field_* locale key', () => {
    const missing: string[] = [];

    for (const field of allFields) {
      const key = `com_config_field_${field.key}`;
      if (!localeKeys.has(key)) {
        missing.push(`${field.key}  →  ${key}`);
      }
    }

    expect(missing, `Missing locale keys:\n  ${missing.join('\n  ')}`).toHaveLength(0);
  });

  it('every array field has a com_config_field_*_item locale key', () => {
    const arrays = allFields.filter((f) => f.isArray);
    const missing: string[] = [];

    for (const field of arrays) {
      const key = `com_config_field_${field.key}_item`;
      if (!localeKeys.has(key)) {
        missing.push(`${field.key}  →  ${key}`);
      }
    }

    expect(missing, `Missing array-item locale keys:\n  ${missing.join('\n  ')}`).toHaveLength(0);
  });
});
