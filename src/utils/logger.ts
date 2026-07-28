type LogLevel = 'INFO' | 'WARN' | 'ERROR';

const formatMessage = (level: LogLevel, message: string) => {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] ${message}`;
};

export const logger = {
  info: (message: string) => {
    console.log(formatMessage('INFO', message));
  },
  warn: (message: string) => {
    console.warn(formatMessage('WARN', message));
  },
  error: (message: string, error?: unknown) => {
    const errorDetails = error instanceof Error ? `: ${error.message}\n${error.stack}` : '';
    console.error(formatMessage('ERROR', `${message}${errorDetails}`));
  },
};
