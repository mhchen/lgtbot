module.exports = {
  apps: [
    {
      name: 'lgtbot',
      script: 'src/index.ts',
      interpreter: 'bun',
      ignore_watch: ['*.db'],
      env: {
        PATH: `${process.env.HOME}/.bun/bin:${process.env.PATH}`,
      },
    },
    {
      name: 'lgtbot-web',
      script: 'web/dist/server/server.js',
      interpreter: 'bun',
      env: {
        NODE_ENV: 'production',
        PORT: '3001',
        PATH: `${process.env.HOME}/.bun/bin:${process.env.PATH}`,
      },
    },
  ],
};
