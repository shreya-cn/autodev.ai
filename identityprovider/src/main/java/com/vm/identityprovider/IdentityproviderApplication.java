package com.vm.identityprovider;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class IdentityproviderApplication {

	public static void main(String[] args) {
		SpringApplication.run(IdentityproviderApplication.class, args);
		System.out.println("Identity Provider Service is running...");
	}

}
