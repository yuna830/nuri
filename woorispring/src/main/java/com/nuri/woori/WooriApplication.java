package com.nuri.woori;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableScheduling
@SpringBootApplication
public class WooriApplication {

    public static void main(String[] args) {
        SpringApplication.run(WooriApplication.class, args);
    }

}