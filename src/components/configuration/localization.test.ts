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
  com_cap_cat_providers: '模型提供商',
  com_cap_col_name: '名称',
  com_cap_col_status: '状态',
  com_cap_edit_title: '编辑 {{name}} 的能力',
  com_cap_empty: '未找到拥有能力的主体',
  com_cap_principal_unavailable: '该主体已不可用',
  com_cap_subtitle: '管理拥有系统级能力的主体',
  com_config_field_agents: '智能体',
  com_config_field_agent: '智能体',
  com_config_field_anthropic: 'Anthropic',
  com_config_field_avatar: '头像',
  com_config_field_azureAssistants: 'Azure Assistants',
  com_config_field_azureOpenAI: 'Azure OpenAI',
  com_config_field_bedrock: 'Amazon Bedrock',
  com_config_field_custom: '自定义',
  com_config_field_customOrder: '自定义顺序',
  com_config_field_customWelcome: '自定义欢迎语',
  com_config_field_defaultModel: '默认模型',
  com_config_field_default_item: '模型',
  com_config_field_directEndpoint: '直接调用端点',
  com_config_field_dropParams: '移除参数',
  com_config_field_dropParams_item: '参数',
  com_config_field_enforce: '强制执行',
  com_config_field_fetch: '自动获取模型',
  com_config_field_google: 'Google',
  com_config_field_group: '群组',
  com_config_field_groups: '群组',
  com_config_field_modelSpecs: '模型规格',
  com_config_field_modelDisplayLabel: '模型显示标签',
  com_config_field_instructions: '指令',
  com_config_field_memories: '记忆',
  com_config_field_modalAcceptance: '弹窗确认',
  com_config_field_modalContent: '弹窗内容',
  com_config_field_modalTitle: '弹窗标题',
  com_config_field_multiConvo: '多对话',
  com_config_field_openAI: 'OpenAI',
  com_config_field_openai: 'OpenAI',
  com_config_field_provider: '提供商',
  com_config_field_privateAssistants: '私有助手',
  com_config_field_prompts: '提示词',
  com_config_field_scraperProvider: '网页抓取提供商',
  com_config_field_scraperTimeout: '网页抓取超时',
  com_config_field_strategy: '策略',
  com_config_field_stream: '流式传输',
  com_config_field_streamRate: '流式输出速率',
  com_config_field_summaryModel: '摘要模型',
  com_config_field_sidePanel: '侧边栏',
  com_config_field_timeout: '超时',
  com_config_field_titleMessageRole: '标题消息角色',
  com_config_field_titleConvo: '生成对话标题',
  com_config_field_userIdQuery: '按用户 ID 查询模型',
  com_config_field_validKeys: '有效键',
  com_config_field_tokenLimit: '令牌限制',
  com_config_field_vertex: 'Google Vertex AI',
  com_config_section_ai_providers: 'AI 提供商',
  com_config_section_configured_count: '{{count}} / {{total}} 已配置',
  com_config_mode_advanced: '高级',
  com_config_mode_simple: '简单',
  com_config_simplify_disabled: '删除额外的语言条目后才能切换到简单模式',
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
  com_ui_item: '项',
  com_ui_items_count: '{{count}} 项',
  com_config_field_addedEndpoints_item: '端点',
  com_config_field_args_item: '参数',
  com_config_field_supportedMimeTypes_item: 'MIME 类型',
  com_config_field_tavilyExtractUrl: 'Tavily 提取 URL',
  com_config_field_tavilySearchOptions: 'Tavily 搜索选项',
  com_a11y_results_found: '已找到 {{count}} 个结果',
  com_a11y_cap_filter_changed: '正在显示 {{count}} 个主体',
  com_cap_count: '{{count}} / {{total}}',
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
