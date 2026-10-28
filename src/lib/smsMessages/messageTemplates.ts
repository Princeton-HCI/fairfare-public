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
  },
  {
    key: 'data_deletion_notification',
    messageTemplate:
      'System: A user ({{userFullName}} - {{userId}}) who had consented to share data with your organization has opted out and stopped data sharing. Please review their data and delete it.'
  }
];

export { messageTemplates, type messageTemplateConfig };
