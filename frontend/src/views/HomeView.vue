<template>
  <div class="home-view">
    <div class="hero">
      <div class="hero-icon">🐘</div>
      <h1 class="hero-title">PostgreSQL Connectivity Helper</h1>
      <p class="hero-subtitle">
        Test and diagnose PostgreSQL database connections with ease.
        Enter your connection details and verify connectivity instantly.
      </p>
      <router-link to="/connectivity" class="btn-primary">
        🔌 Start Connectivity Test
      </router-link>
    </div>

    <div class="features">
      <div class="feature-card">
        <div class="feature-icon">⚡</div>
        <h3>Connection Testing</h3>
        <p>Test TCP reachability and full PostgreSQL authentication in one click.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">📊</div>
        <h3>Server Metrics</h3>
        <p>Fetch live server stats: connections, locks, query performance, and more.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">🗂️</div>
        <h3>Schema Explorer</h3>
        <p>Browse databases and schemas with table counts and index info.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">🔒</div>
        <h3>SSL Support</h3>
        <p>Supports disable, require, verify-ca, and verify-full SSL modes.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-view {
  padding: 2rem;
  max-width: 900px;
  margin: 0 auto;
}

.hero {
  text-align: center;
  padding: 3rem 2rem;
  background: linear-gradient(135deg, #1e3a5f 0%, #0f2342 100%);
  border-radius: 16px;
  margin-bottom: 2.5rem;
  border: 1px solid rgba(255,255,255,0.08);
}

.hero-icon {
  font-size: 3.5rem;
  margin-bottom: 1rem;
}

.hero-title {
  font-size: 2rem;
  font-weight: 700;
  color: #e8f4fd;
  margin: 0 0 1rem;
}

.hero-subtitle {
  color: #94b8d4;
  font-size: 1.05rem;
  line-height: 1.7;
  max-width: 520px;
  margin: 0 auto 1.8rem;
}

.btn-primary {
  display: inline-block;
  padding: 0.75rem 1.75rem;
  background: #2563eb;
  color: #fff;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
  font-size: 1rem;
  transition: background 0.2s ease, transform 0.15s ease;
}

.btn-primary:hover {
  background: #1d4ed8;
  transform: translateY(-1px);
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 1.25rem;
}

.feature-card {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 1.5rem;
  text-align: center;
  transition: border-color 0.2s ease;
}

.feature-card:hover {
  border-color: rgba(37,99,235,0.5);
}

.feature-icon {
  font-size: 2rem;
  margin-bottom: 0.75rem;
}

.feature-card h3 {
  font-size: 1rem;
  font-weight: 600;
  color: #c8dff0;
  margin: 0 0 0.5rem;
}

.feature-card p {
  font-size: 0.875rem;
  color: #7a9ab5;
  line-height: 1.6;
  margin: 0;
}
</style>
