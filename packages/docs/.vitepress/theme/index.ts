import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import ArchitectureDiagram from '../components/ArchitectureDiagram.vue';
import SystemLayoutDiagram from '../components/SystemLayoutDiagram.vue';
import './style.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('ArchitectureDiagram', ArchitectureDiagram);
    app.component('SystemLayoutDiagram', SystemLayoutDiagram);
  },
} satisfies Theme;
