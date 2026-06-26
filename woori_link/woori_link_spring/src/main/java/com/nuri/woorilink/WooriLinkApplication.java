package com.nuri.woorilink;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;

@SpringBootApplication(exclude = { UserDetailsServiceAutoConfiguration.class })
public class WooriLinkApplication {
    public static void main(String[] args) {
        SpringApplication.run(WooriLinkApplication.class, args);
    }
}
