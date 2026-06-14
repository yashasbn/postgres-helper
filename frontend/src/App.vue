<script setup lang="ts">
</script>

<template>
  <div class="layout">
    <header class="top-bar">
      <div class="top-bar-product">PostgreSQL Connectivity Helper</div>
    </header>
    <div class="app-body">
      <aside class="sidebar">
        <nav class="tree-nav" role="navigation" aria-label="main navigation">
          <ul>
            <li>
              <router-link to="/">
                <span class="nav-icon">🏠</span>
                Home
              </router-link>
            </li>
            <li>
              <router-link to="/connectivity">
                <span class="nav-icon">🔌</span>
                Connectivity Test
              </router-link>
            </li>
          </ul>
        </nav>
      </aside>
      <main class="page container"><router-view /></main>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nav-icon {
  margin-right: 8px;
  font-size: 16px;
}
</style>
