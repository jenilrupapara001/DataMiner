import React from "react";
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
} from "react-native";

export default function TicketsScreen() {
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Tickets</Text>

                <Text style={styles.description}>
                    Ticket management module is currently under development.
                </Text>

                <View style={styles.badge}>
                    <Text style={styles.badgeText}>Coming Soon</Text>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8FAFC",
    },

    content: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 24,
    },

    title: {
        fontSize: 28,
        fontWeight: "700",
        color: "#0F172A",
        marginBottom: 12,
    },

    description: {
        fontSize: 15,
        color: "#64748B",
        textAlign: "center",
        lineHeight: 22,
        maxWidth: 280,
    },

    badge: {
        marginTop: 24,
        backgroundColor: "#EFF6FF",
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 999,
    },

    badgeText: {
        color: "#2563EB",
        fontSize: 13,
        fontWeight: "600",
    },
});