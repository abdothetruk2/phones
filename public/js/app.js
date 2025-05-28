const { createApp } = Vue;

createApp({
  data() {
    return {
      message: 'WE Account Information',
      username: '',
      password: '',
      result: [],
      loading: false,
      errorMessage: '',
      successMessage: ''
    }
  },
  methods: {
    async submitForm() {
      this.loading = true;
      this.errorMessage = '';
      this.successMessage = '';
      try {
        const response = await axios.post('/', {
          username: this.username,
          password: this.password
        });
        
        // Add the new data to the result array
        if (response.data && response.data.data2) {
          this.result.push({
            number: response.data.data2.number || '',
            package: response.data.data2.package || '',
            minutes: response.data.data2.minutes || '',
            internet: response.data.data2.internet || '',
            timestamp: new Date().toLocaleString()
          });
        }
        
        this.successMessage = 'Data fetched successfully!';
      } catch (error) {
        console.error('Error making POST request:', error);
        this.errorMessage = 'An error occurred while fetching data.';
      } finally {
        this.loading = false;
      }
    },
    async fetchData() {
      try {
        const response = await axios.get('/api/users');
        
        // Clear the current result array
        this.result = [];
        
        // Add each user's data to the result array
        if (response.data && response.data.length > 0) {
          response.data.forEach(user => {
            this.result.push({
              number: user.number || '',
              package: user.package || '',
              minutes: user.minutes || '',
              internet: user.internet || '',
              timestamp: new Date(user.lastChecked).toLocaleString()
            });
          });
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        this.errorMessage = 'An error occurred while fetching data.';
      }
    }
  },
  mounted() {
    this.fetchData();
  }
}).mount('#app');