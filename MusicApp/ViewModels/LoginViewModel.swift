import Foundation
import SwiftUI
import Combine
import LocalAuthentication
import Security

@MainActor
final class LoginViewModel: ObservableObject {
    enum LoginMode {
        case signIn, signUp
    }
    
    @Published var mode: LoginMode = .signIn
    @Published var email = ""
    @Published var password = ""
    @Published var confirmPassword = ""
    @Published var displayName = ""
    @Published var isLoading = false
    @Published var error: Error?
    @Published var showPassword = false
    @Published var showConfirmPassword = false
    @Published var biometricsEnabled = false
    @Published var isBiometricsAvailable = false
    
    private var database = DatabaseManager.shared
    
    var isFormValid: Bool {
        guard isValidEmail(email) else { return false }
        guard !password.isEmpty else { return false }
        
        switch mode {
        case .signIn:
            return true
        case .signUp:
            return !displayName.isEmpty && password == confirmPassword && password.count >= 8
        }
    }
    
    var title: String {
        switch mode {
        case .signIn: return "Welcome Back"
        case .signUp: return "Create Account"
        }
    }
    
    var subtitle: String {
        switch mode {
        case .signIn: return "Sign in to continue to your music"
        case .signUp: return "Join to start listening"
        }
    }
    
    var buttonTitle: String {
        switch mode {
        case .signIn: return "Sign In"
        case .signUp: return "Create Account"
        }
    }
    
    func toggleMode() {
        mode = mode == .signIn ? .signUp : .signIn
        error = nil
    }
    
    func submit() async {
        guard isFormValid else { return }
        isLoading = true
        error = nil
        
        do {
            switch mode {
            case .signIn:
                _ = try await database.login(email: email, password: password)
            case .signUp:
                _ = try await database.createAccount(email: email, password: password, name: displayName)
            }
            
            if biometricsEnabled {
                try? await BiometricAuthService.shared.enableBiometrics(for: email, password: password)
            }
        } catch {
            self.error = error
        }
        
        isLoading = false
    }
    
    private func isValidEmail(_ email: String) -> Bool {
        let pattern = #"^[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"#
        return email.range(of: pattern, options: .regularExpression) != nil
    }
}

final class BiometricAuthService {
    static let shared = BiometricAuthService()
    
    func isBiometricsAvailable() -> Bool {
        true
    }
    
    func enableBiometrics(for email: String, password: String) async throws {
        UserDefaults.standard.set(email, forKey: "biometric_email")
        KeychainService.shared.save(password, for: "biometric_password")
    }
    
    func authenticateWithBiometrics() async throws -> (email: String, password: String)? {
        let context = LAContext()
        var error: NSError?
        
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            return nil
        }
        
        let success = try await context.evaluatePolicy(
            .deviceOwnerAuthenticationWithBiometrics,
            localizedReason: "Authenticate to sign in"
        )
        
        guard success else { return nil }
        
        guard let email = UserDefaults.standard.string(forKey: "biometric_email"),
              let password = KeychainService.shared.read(for: "biometric_password") else {
            return nil
        }
        
        return (email, password)
    }
}

class KeychainService {
    static let shared = KeychainService()
    
    private init() {}
    
    func save(_ value: String, for key: String) {
        let data = Data(value.utf8)
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String: data
        ]
        
        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }
    
    func read(for key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
    
    func delete(for key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key
        ]
        SecItemDelete(query as CFDictionary)
    }
}