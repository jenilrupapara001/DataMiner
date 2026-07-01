import React from "react";
import {
  Card,
  Typography,
  ConfigProvider,
  Space,
  Divider,
} from "antd";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  BarChart3,
  Users,
  Clock3,
} from "lucide-react";

import { RetailOpsWordmark } from "../common/BrandLogo";

const { Text, Title } = Typography;

const AuthLayout = ({
  children,
  footerText = "RetailOps Technologies",
}) => {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#0145F2",
          colorInfo: "#0145F2",
          borderRadius: 14,
          fontFamily: "Inter, sans-serif",
          colorBgContainer: "#FFFFFF",
          colorText: "#0F172A",
          colorTextDescription: "#64748B",
        },

        components: {
          Button: {
            controlHeight: 52,
            borderRadius: 14,
            fontWeight: 600,
            fontSize: 14,
          },

          Input: {
            controlHeight: 52,
            borderRadius: 14,
            activeBorderColor: "#0145F2",
          },

          Checkbox: {
            colorPrimary: "#0145F2",
          },
        },
      }}
    >
      <div style={styles.page}>
        <div style={styles.backgroundGlowTop} />
        <div style={styles.backgroundGlowBottom} />

        <div style={styles.container}>
          {/* ====================================================== */}
          {/* LEFT SIDE */}
          {/* ====================================================== */}

          <motion.div
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45 }}
            style={styles.leftSection}
          >
            <Card
              bordered={false}
              style={styles.authCard}
              bodyStyle={{
                padding: 40,
              }}
            >
              {/* Logo */}
              <div style={styles.logoWrapper}>
                <RetailOpsWordmark
                  size={26}
                  color="#0F172A"
                />
              </div>

              {/* Security Badge */}
              <div style={styles.securityBadge}>
                <ShieldCheck
                  size={16}
                  color="#16A34A"
                />

                <Text
                  style={{
                    fontSize: 12,
                    color: "#475569",
                    fontWeight: 500,
                  }}
                >
                  Secure enterprise authentication
                </Text>
              </div>

              <Divider
                style={{
                  marginTop: 24,
                  marginBottom: 24,
                }}
              />

              {children}

              <Divider />

              <div style={styles.footer}>
                <Text
                  style={{
                    fontSize: 12,
                    color: "#94A3B8",
                  }}
                >
                  RetailOps Partner Platform
                </Text>

                <br />

                <Text
                  style={{
                    fontSize: 11,
                    color: "#CBD5E1",
                  }}
                >
                  © 2026 {footerText}
                </Text>
              </div>
            </Card>
          </motion.div>

          {/* ====================================================== */}
          {/* RIGHT SIDE */}
          {/* ====================================================== */}

          <motion.div
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55 }}
            style={styles.rightSection}
          >
            <div style={styles.rightContent}>
              <Text style={styles.badge}>
                RetailOps Intelligence Platform
              </Text>

              <Title
                level={1}
                style={styles.heroTitle}
              >
                Unified Commerce
                <br />
                Operations Platform
              </Title>

              <Text style={styles.heroSubtitle}>
                Manage sellers, workflows, tickets,
                SLAs, analytics, reports and support
                operations from a single enterprise
                ecosystem.
              </Text>

              {/* KPI GRID */}

              <div style={styles.kpiGrid}>
                <div style={styles.kpiCard}>
                  <BarChart3
                    size={18}
                    color="#0145F2"
                  />

                  <Title
                    level={3}
                    style={styles.kpiNumber}
                  >
                    50K+
                  </Title>

                  <Text style={styles.kpiLabel}>
                    Monthly Tasks
                  </Text>
                </div>

                <div style={styles.kpiCard}>
                  <Clock3
                    size={18}
                    color="#0145F2"
                  />

                  <Title
                    level={3}
                    style={styles.kpiNumber}
                  >
                    99.8%
                  </Title>

                  <Text style={styles.kpiLabel}>
                    SLA Compliance
                  </Text>
                </div>

                <div style={styles.kpiCard}>
                  <Users
                    size={18}
                    color="#0145F2"
                  />

                  <Title
                    level={3}
                    style={styles.kpiNumber}
                  >
                    500+
                  </Title>

                  <Text style={styles.kpiLabel}>
                    Seller Partners
                  </Text>
                </div>

                <div style={styles.kpiCard}>
                  <ShieldCheck
                    size={18}
                    color="#0145F2"
                  />

                  <Title
                    level={3}
                    style={styles.kpiNumber}
                  >
                    24/7
                  </Title>

                  <Text style={styles.kpiLabel}>
                    Support Operations
                  </Text>
                </div>
              </div>

              {/* Trusted Brands */}

              <div style={styles.brandSection}>
                <Text style={styles.brandLabel}>
                  TRUSTED COMMERCE NETWORK
                </Text>

                <Space size={20}>
                  <Text strong>Amazon</Text>
                  <Text strong>Flipkart</Text>
                  <Text strong>Myntra</Text>
                  <Text strong>Nykaa</Text>
                  <Text strong>Ajio</Text>
                </Space>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </ConfigProvider>
  );
};

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(180deg,#FFFFFF 0%,#F8FAFC 100%)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    position: "relative",
    overflow: "hidden",
  },

  backgroundGlowTop: {
    position: "absolute",
    width: 500,
    height: 500,
    background:
      "rgba(1,69,242,0.05)",
    borderRadius: "50%",
    top: -200,
    right: -150,
    filter: "blur(80px)",
  },

  backgroundGlowBottom: {
    position: "absolute",
    width: 500,
    height: 500,
    background:
      "rgba(59,130,246,0.04)",
    borderRadius: "50%",
    bottom: -250,
    left: -200,
    filter: "blur(90px)",
  },

  container: {
    width: "100%",
    maxWidth: 1320,
    display: "grid",
    gridTemplateColumns: "520px 1fr",
    gap: 80,
    alignItems: "center",
    zIndex: 2,
  },

  leftSection: {},

  authCard: {
    borderRadius: 24,
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",

    boxShadow: `
      0 1px 2px rgba(15,23,42,.04),
      0 8px 24px rgba(15,23,42,.06),
      0 24px 48px rgba(15,23,42,.04)
    `,
  },

  logoWrapper: {
    display: "flex",
    justifyContent: "center",
  },

  securityBadge: {
    marginTop: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  footer: {
    textAlign: "center",
  },

  rightSection: {},

  rightContent: {
    maxWidth: 620,
  },

  badge: {
    padding: "8px 14px",
    borderRadius: 999,
    background: "#EFF6FF",
    color: "#0145F2",
    fontWeight: 600,
  },

  heroTitle: {
    marginTop: 24,
    marginBottom: 16,
    fontSize: 52,
    lineHeight: 1.1,
    color: "#0F172A",
  },

  heroSubtitle: {
    fontSize: 18,
    color: "#64748B",
    lineHeight: 1.8,
  },

  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2,1fr)",
    gap: 20,
    marginTop: 40,
  },

  kpiCard: {
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: 20,
    padding: 24,
  },

  kpiNumber: {
    marginTop: 12,
    marginBottom: 4,
  },

  kpiLabel: {
    color: "#64748B",
  },

  brandSection: {
    marginTop: 40,
  },

  brandLabel: {
    display: "block",
    marginBottom: 12,
    fontSize: 11,
    letterSpacing: 1,
    color: "#94A3B8",
  },
};

export default AuthLayout;