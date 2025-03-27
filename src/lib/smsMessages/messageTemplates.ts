import { _ } from 'svelte-i18n';
interface messageTemplateConfig {
  key: string;
  messageTemplate: string;
}

const messageTemplates: messageTemplateConfig[] = [
  {
    key: 'welcome',
    messageTemplate:
      "System: Thanks for signing up. Syncing data can take up to a few hours. Once synced, we'll send you a link to view your rideshare data."
  },
  {
    key: 'welcome_with_data_sharing_consent',
    messageTemplate:
      "System: You've agreed to share your data with {{organizationName}}. Syncing data can take up to a few hours. Once synced, we'll send you a link to view your rideshare data."
  },
  {
    key: 'view_take_rate',
    messageTemplate: 'System: Your rideshare data is ready: {{driverDataLink}}'
  }
];

export { messageTemplates, type messageTemplateConfig };
