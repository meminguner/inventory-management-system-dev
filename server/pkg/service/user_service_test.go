package service

import (
	"errors"
	"ims-intro/pkg/domain"
	"ims-intro/pkg/service/dto"
	"testing"

	"golang.org/x/crypto/bcrypt"
)

type fakeUserRepository struct {
	usersById       map[int64]domain.User
	usersByName     map[string]domain.User
	signedUpUser    *domain.User
	updatedUser     *domain.User
	updatedProfile  *domain.User
	deletedUserId   int64
	deleteWasCalled bool
}

func newFakeUserRepository(users ...domain.User) *fakeUserRepository {
	f := &fakeUserRepository{
		usersById:   map[int64]domain.User{},
		usersByName: map[string]domain.User{},
	}
	for _, u := range users {
		f.usersById[u.Id] = u
		f.usersByName[u.Username] = u
	}
	return f
}

func (f *fakeUserRepository) GetUserByUsername(username string) (domain.User, error) {
	u, ok := f.usersByName[username]
	if !ok {
		return domain.User{}, errors.New("not found")
	}
	return u, nil
}

func (f *fakeUserRepository) GetUserById(id int64) (domain.User, error) {
	u, ok := f.usersById[id]
	if !ok {
		return domain.User{}, errors.New("not found")
	}
	return u, nil
}

func (f *fakeUserRepository) GetAllUsers() ([]domain.User, error) {
	return nil, nil
}

func (f *fakeUserRepository) SignUp(user domain.User) error {
	f.signedUpUser = &user
	return nil
}

func (f *fakeUserRepository) UpdateUser(user domain.User) error {
	f.updatedUser = &user
	return nil
}

func (f *fakeUserRepository) UpdateProfile(user domain.User) error {
	f.updatedProfile = &user
	return nil
}

func (f *fakeUserRepository) DeleteUser(id int64) error {
	f.deleteWasCalled = true
	f.deletedUserId = id
	return nil
}

func hashOf(t *testing.T, password string) string {
	t.Helper()
	h, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("bcrypt hash üretilemedi: %v", err)
	}
	return string(h)
}

// ─── Login ───────────────────────────────────────────────────────────────────

func TestLogin_Success(t *testing.T) {
	t.Setenv("JWT_KEY", "test-secret")
	repo := newFakeUserRepository(domain.User{
		Id: 1, Username: "ayse", Password: hashOf(t, "dogru-sifre"), Role: "user",
	})
	svc := NewUserService(repo)

	token, err := svc.Login("ayse", "dogru-sifre")
	if err != nil {
		t.Fatalf("beklenmeyen hata: %v", err)
	}
	if token == "" {
		t.Fatal("boş token döndü")
	}
}

func TestLogin_WrongPassword(t *testing.T) {
	repo := newFakeUserRepository(domain.User{
		Id: 1, Username: "ayse", Password: hashOf(t, "dogru-sifre"), Role: "user",
	})
	svc := NewUserService(repo)

	if _, err := svc.Login("ayse", "yanlis-sifre"); err == nil {
		t.Fatal("yanlış şifrede hata bekleniyordu")
	}
}

func TestLogin_UnknownUser(t *testing.T) {
	svc := NewUserService(newFakeUserRepository())

	if _, err := svc.Login("yok-boyle-biri", "x"); err == nil {
		t.Fatal("olmayan kullanıcıda hata bekleniyordu")
	}
}

// ─── SignUp ──────────────────────────────────────────────────────────────────

func TestSignUp_HashesPasswordAndDefaultsToUserRole(t *testing.T) {
	repo := newFakeUserRepository()
	svc := NewUserService(repo)

	if err := svc.SignUp(dto.UserCreate{Username: "yeni", Password: "sifre123"}); err != nil {
		t.Fatalf("beklenmeyen hata: %v", err)
	}
	if repo.signedUpUser == nil {
		t.Fatal("SignUp repository'e ulaşmadı")
	}
	if repo.signedUpUser.Role != "user" {
		t.Fatalf("yeni kullanıcı 'user' rolüyle açılmalı, geldi: %q", repo.signedUpUser.Role)
	}
	if repo.signedUpUser.Password == "sifre123" {
		t.Fatal("şifre düz metin kaydedilmemeli")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(repo.signedUpUser.Password), []byte("sifre123")); err != nil {
		t.Fatal("kaydedilen hash orijinal şifreyle eşleşmiyor")
	}
}

func TestSignUp_EmptyFieldsRejected(t *testing.T) {
	svc := NewUserService(newFakeUserRepository())

	if err := svc.SignUp(dto.UserCreate{Username: "", Password: "x"}); err == nil {
		t.Fatal("boş username reddedilmeliydi")
	}
	if err := svc.SignUp(dto.UserCreate{Username: "x", Password: ""}); err == nil {
		t.Fatal("boş şifre reddedilmeliydi")
	}
}

// ─── UpdateUser / DeleteUser — RBAC ──────────────────────────────────────────

func TestUpdateUser_OnlyAdminAllowed(t *testing.T) {
	for _, role := range []string{"user", "super_user", ""} {
		repo := newFakeUserRepository(domain.User{Id: 2, Username: "hedef", Role: "user"})
		svc := NewUserService(repo)

		if err := svc.UpdateUser(2, "hedef", "super_user", role); err == nil {
			t.Fatalf("%q rolü kullanıcı güncelleyememeli", role)
		}
		if repo.updatedUser != nil {
			t.Fatalf("%q rolünde güncelleme repository'e ulaşmamalıydı", role)
		}
	}
}

func TestUpdateUser_CannotModifyAdmin(t *testing.T) {
	repo := newFakeUserRepository(domain.User{Id: 2, Username: "patron", Role: "admin"})
	svc := NewUserService(repo)

	if err := svc.UpdateUser(2, "patron", "user", "admin"); err == nil {
		t.Fatal("admin başka bir admin'i değiştirememeli")
	}
}

func TestUpdateUser_AdminUpdatesRegularUser(t *testing.T) {
	repo := newFakeUserRepository(domain.User{Id: 2, Username: "hedef", Role: "user"})
	svc := NewUserService(repo)

	if err := svc.UpdateUser(2, "yeni-isim", "super_user", "admin"); err != nil {
		t.Fatalf("beklenmeyen hata: %v", err)
	}
	if repo.updatedUser == nil || repo.updatedUser.Username != "yeni-isim" || repo.updatedUser.Role != "super_user" {
		t.Fatalf("güncelleme yanlış: %+v", repo.updatedUser)
	}
}

func TestDeleteUser_OnlyAdminAllowed(t *testing.T) {
	repo := newFakeUserRepository(domain.User{Id: 2, Username: "hedef", Role: "user"})
	svc := NewUserService(repo)

	if err := svc.DeleteUser(2, "super_user"); err == nil {
		t.Fatal("super_user kullanıcı silememeli")
	}
	if repo.deleteWasCalled {
		t.Fatal("yetkisiz silme repository'e ulaşmamalıydı")
	}
}

func TestDeleteUser_CannotDeleteAdmin(t *testing.T) {
	repo := newFakeUserRepository(domain.User{Id: 2, Username: "patron", Role: "admin"})
	svc := NewUserService(repo)

	if err := svc.DeleteUser(2, "admin"); err == nil {
		t.Fatal("admin başka bir admin'i silememeli")
	}
	if repo.deleteWasCalled {
		t.Fatal("admin silme repository'e ulaşmamalıydı")
	}
}

func TestDeleteUser_AdminDeletesRegularUser(t *testing.T) {
	repo := newFakeUserRepository(domain.User{Id: 2, Username: "hedef", Role: "user"})
	svc := NewUserService(repo)

	if err := svc.DeleteUser(2, "admin"); err != nil {
		t.Fatalf("beklenmeyen hata: %v", err)
	}
	if !repo.deleteWasCalled || repo.deletedUserId != 2 {
		t.Fatal("silme repository'e doğru id ile ulaşmadı")
	}
}

// ─── UpdateProfile ───────────────────────────────────────────────────────────

func TestUpdateProfile_WrongCurrentPassword(t *testing.T) {
	repo := newFakeUserRepository(domain.User{
		Id: 1, Username: "ayse", Password: hashOf(t, "mevcut"), Role: "user",
	})
	svc := NewUserService(repo)

	if _, _, err := svc.UpdateProfile(1, "ayse", "yanlis", ""); err == nil {
		t.Fatal("yanlış mevcut şifrede hata bekleniyordu")
	}
}

func TestUpdateProfile_UsernameTaken(t *testing.T) {
	repo := newFakeUserRepository(
		domain.User{Id: 1, Username: "ayse", Password: hashOf(t, "mevcut"), Role: "user"},
		domain.User{Id: 2, Username: "fatma", Role: "user"},
	)
	svc := NewUserService(repo)

	if _, _, err := svc.UpdateProfile(1, "fatma", "mevcut", ""); err == nil {
		t.Fatal("kullanılan username'e geçiş reddedilmeliydi")
	}
}

func TestUpdateProfile_ChangesUsernameAndPassword(t *testing.T) {
	t.Setenv("JWT_KEY", "test-secret")
	repo := newFakeUserRepository(domain.User{
		Id: 1, Username: "ayse", Password: hashOf(t, "mevcut"), Role: "user",
	})
	svc := NewUserService(repo)

	updated, token, err := svc.UpdateProfile(1, "ayse-yeni", "mevcut", "yeni-sifre")
	if err != nil {
		t.Fatalf("beklenmeyen hata: %v", err)
	}
	if updated.Username != "ayse-yeni" {
		t.Fatalf("username güncellenmedi: %q", updated.Username)
	}
	if token == "" {
		t.Fatal("yeni token dönmeliydi")
	}
	if repo.updatedProfile == nil {
		t.Fatal("UpdateProfile repository'e ulaşmadı")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(repo.updatedProfile.Password), []byte("yeni-sifre")); err != nil {
		t.Fatal("yeni şifre hash'lenerek kaydedilmeliydi")
	}
}

func TestUpdateProfile_EmptyNewPasswordKeepsOldHash(t *testing.T) {
	t.Setenv("JWT_KEY", "test-secret")
	oldHash := hashOf(t, "mevcut")
	repo := newFakeUserRepository(domain.User{
		Id: 1, Username: "ayse", Password: oldHash, Role: "user",
	})
	svc := NewUserService(repo)

	if _, _, err := svc.UpdateProfile(1, "ayse", "mevcut", "   "); err != nil {
		t.Fatalf("beklenmeyen hata: %v", err)
	}
	if repo.updatedProfile.Password != oldHash {
		t.Fatal("yeni şifre boşken eski hash korunmalıydı")
	}
}
