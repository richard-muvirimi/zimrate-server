import HeroSection from '../sections/HeroSection';
import HowItWorksSection from '../sections/HowItWorksSection';
import FeaturesSection from '../sections/FeaturesSection';
import RatesTableSection from '../sections/RatesTableSection';
import OfficialAppsSection from '../sections/OfficialAppsSection';
import CtaSection from '../sections/CtaSection';
import { Box } from '@mui/material';
import SiteLayout from '../components/SiteLayout';

export default function HomePage() {
  return (
    <SiteLayout>
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <HeroSection />
        <HowItWorksSection />
        <FeaturesSection />
        <RatesTableSection />
        <OfficialAppsSection />
        <CtaSection />
      </Box>
    </SiteLayout>
  );
}
