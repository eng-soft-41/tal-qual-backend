# tal-qual Backend

Backend API for importing and serving the `tal-qual` comparison dataset.

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Start MongoDB with Docker

Check that Docker is available:

```bash
docker --version
```

If Docker is not installed, install Docker Desktop for Mac:

```text
https://www.docker.com/products/docker-desktop/
```

Start a local MongoDB container:

```bash
docker run --name tal-qual-mongo -p 27017:27017 -d mongo:7
```

Check that it is running:

```bash
docker ps
```

You should see a container named `tal-qual-mongo`.

If the container already exists but is stopped, start it with:

```bash
docker start tal-qual-mongo
```

### 3. Configure environment variables

Create `.env` in this project root:

```env
PORT=3333
MONGO_URI=mongodb://localhost:27017
DATABASE=tal_qual
```

### 4. Import the comparison dataset

From this backend project root:

```bash
npm run import:comparisons -- ../tal-qual-comparisons-output/data/export/backend/comparisons/v1
```

> Repo: https://github.com/eng-soft-41/tal-qual-comparisons-output

Expected import summary values:

```text
candidate_count: 2136
visualization_ready_count: 2133
ground_count: 40
vehicle_count: 742
ground_vehicle_pair_count: 940
```

### 5. Run the backend

```bash
npm run dev
```

The server should listen on:

```text
http://localhost:3333
```

## Smoke Tests

In another terminal, run:

```bash
curl http://localhost:3333/comparisons/manifest
curl "http://localhost:3333/comparisons/grounds?limit=5"
curl "http://localhost:3333/comparisons/vehicles?limit=5"
curl "http://localhost:3333/comparisons/pairs?ground=cair&limit=5"
curl "http://localhost:3333/comparisons/examples?vehicle=bomba&limit=3"
```

## Build Check

```bash
npm run build
```

## Useful MongoDB Docker Commands

Stop MongoDB:

```bash
docker stop tal-qual-mongo
```

Start MongoDB again:

```bash
docker start tal-qual-mongo
```

View MongoDB logs:

```bash
docker logs tal-qual-mongo
```

Delete the MongoDB container and its data:

```bash
docker rm -f tal-qual-mongo
```
