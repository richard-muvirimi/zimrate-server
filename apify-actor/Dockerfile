# Apify's official image — includes Node 20, Playwright, and Chrome.
# Required for PlaywrightCrawler to work on the Apify platform.
FROM apify/actor-node-playwright-chrome:20

# Copy dependency manifests first for better layer caching
COPY package*.json ./
RUN npm install --omit=dev

# Copy actor source
COPY . ./

CMD npm start
