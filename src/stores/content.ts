import { defineStore } from "pinia";
import { ref } from "vue";
import { api } from "../api/client";

interface CourseModule {
  id: string;
  title: string;
  description: string;
  icon: string;
  units: { id: string; title: string; estimatedMinutes: number; stepCount: number }[];
}

interface CourseTree {
  id: string;
  title: string;
  modules: CourseModule[];
}

export const useContentStore = defineStore("content", () => {
  const course = ref<CourseTree | null>(null);
  const loading = ref(false);

  async function load() {
    loading.value = true;
    try {
      course.value = await api.get<CourseTree>("/course");
    } finally {
      loading.value = false;
    }
  }

  return { course, loading, load };
});
