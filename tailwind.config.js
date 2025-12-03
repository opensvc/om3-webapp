/** @type {import('tailwindcss').Config} */
const tailwindConfig = {
    content: ['./pages/**/*.{js,ts,jsx,tsx}', './src/**/*.{js,ts,jsx,tsx}'],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                gray: {
                    700: '#5d5d5d',
                    800: '#4d4d4d',
                    900: '#3d3d3d',
                },
            },
            backgroundColor: {
                'dark-primary': '#4d4d4d',
                'dark-secondary': '#5d5d5d',
                'dark-tertiary': '#6d6d6d',
            },
            textColor: {
                'dark-primary': '#ffffff',
                'dark-secondary': '#eeeeee',
            }
        },
    },
    plugins: [],
};
export default tailwindConfig;
